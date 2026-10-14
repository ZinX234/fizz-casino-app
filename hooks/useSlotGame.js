import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '@/config/gameConfig';
import * as engine from '@/game/engine';
import { getWinningCells } from '@/game/paylines';
import { buildClueCards, getBonusChoice, gooeyWildCount, surveillanceMultiplier, surveillanceWildCount } from '@/game/bonus';
import { sound } from '@/game/sound';
import { formatCoins } from '@/game/format';
import { wagerCentsFromFizzcoins } from '@/lib/fizzcoin-wager';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const coinsFromUsd = (amount) => Math.round(Number(amount) * 400);

function tierFor(amount, bet) {
  const multiple = amount / Math.max(bet, 0.01);
  if (multiple >= 250) return 'MEGA WIN';
  if (multiple >= 50) return 'BIG WIN';
  if (multiple >= 15) return 'NICE WIN';
  return null;
}

function pickStateFromRound(round, bet) {
  if (round?.donutDivision?.bonusStage !== 'pick') return null;
  const revealed = new Map(round.donutDivision.revealedCards.map((card) => [card.position, card.value]));
  const cards = Array.from({ length: 12 }, (_, position) => ({
    id: `card-${position}`,
    position,
    value: revealed.get(position) ?? 0,
    revealed: revealed.has(position),
  }));
  const total = [...revealed.values()].reduce((sum, value) => sum + value * bet, 0);
  return { cards, picks: round.picks.length, total };
}

async function postGameAction(payload) {
  const response = await fetch('/api/games/donut-division/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `The game request failed (${response.status}).`);
  if (!result.round) throw new Error('The server did not return the game round.');
  return result;
}

/** Game loop for the uploaded Donut Division UI; paid results always come from the casino API. */
export default function useSlotGame({ demo, initialRound = null, initialBalance = '0', rtpBps = 9600, currency = 'USD' }) {
  const [bet, setBet] = useState(CONFIG.bets.default);
  const [round, setRound] = useState(initialRound);
  const [grid, setGrid] = useState(() => initialRound?.donutDivision?.grid ?? engine.emptyGrid());
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(CONFIG.reels);
  const [balance, setBalance] = useState(() => coinsFromUsd(initialBalance));
  const [winCells, setWinCells] = useState([]);
  const [winLines, setWinLines] = useState([]);
  const [winAmount, setWinAmount] = useState(0);
  const [displayWin, setDisplayWin] = useState(0);
  const [banner, setBanner] = useState(null);
  const [gooey, setGooey] = useState(null);
  const [bonusChoice, setBonusChoice] = useState(initialRound?.donutDivision?.bonusStage === 'choose');
  const [freeSpins, setFreeSpins] = useState(null);
  const [pickBonus, setPickBonus] = useState(() => pickStateFromRound(initialRound, coinsFromUsd(initialRound?.wager ?? 0)));
  const [maxWin, setMaxWin] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [autoplayLeft, setAutoplayLeft] = useState(0);
  const [quickSpin, setQuickSpin] = useState(false);
  const [soundOn, setSoundOn] = useState(CONFIG.sound.enabledByDefault);
  const [message, setMessage] = useState('');

  const busy = useRef(false);
  const stickyRef = useRef([]);
  const pickRef = useRef(pickStateFromRound(initialRound, coinsFromUsd(initialRound?.wager ?? 0)));
  const betRef = useRef(bet);
  const demoRef = useRef(demo);
  const quickRef = useRef(quickSpin);
  const startRequestId = useRef(null);
  const bonusRequestId = useRef(null);
  const pickRequestIds = useRef(new Map());

  const setBusy = useCallback((value) => {
    busy.current = value;
    setActionBusy(value);
  }, []);

  useEffect(() => { betRef.current = bet; }, [bet]);
  useEffect(() => { demoRef.current = demo; }, [demo]);
  useEffect(() => { quickRef.current = quickSpin; }, [quickSpin]);
  useEffect(() => { sound.setEnabled(soundOn); }, [soundOn]);

  const speed = useCallback((ms) => (quickRef.current ? ms * CONFIG.animation.quickFactor : ms), []);

  const countUp = useCallback((target) => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / CONFIG.animation.winCountMs);
      setDisplayWin(target * (1 - (1 - progress) ** 3));
      if (progress < 1) requestAnimationFrame(step);
      else setDisplayWin(target);
    };
    requestAnimationFrame(step);
  }, []);

  const updateFromServer = useCallback((result) => {
    const nextRound = result.round;
    setRound(nextRound);
    if (result.wallet?.balance !== undefined) setBalance(coinsFromUsd(result.wallet.balance));
    const nextPick = pickStateFromRound(nextRound, coinsFromUsd(nextRound.wager));
    pickRef.current = nextPick;
    setPickBonus(nextPick);
    return nextRound;
  }, []);

  const animateServerGrid = useCallback(async (nextGrid, alreadySpinning = false, serverLineWins) => {
    setWinCells([]);
    setWinLines([]);
    if (!alreadySpinning) {
      setSpinning(true);
      setStoppedReels(0);
      setSpinId(Date.now() + Math.random());
      sound.spin();
    }
    setGrid(nextGrid);
    await sleep(speed(CONFIG.animation.reelStopDelay));
    for (let reel = 0; reel < CONFIG.reels; reel += 1) {
      setStoppedReels(reel + 1);
      sound.reelStop();
      await sleep(speed(CONFIG.animation.reelStagger));
    }
    await sleep(speed(CONFIG.animation.postStop));
    setSpinning(false);
    const evaluation = engine.evaluateGrid(nextGrid, betRef.current);
    const lineWins = serverLineWins ?? evaluation.wins;
    const winCells = serverLineWins
      ? getWinningCells(nextGrid, serverLineWins)
      : evaluation.winCells;
    const lineIndexes = lineWins.map((win) => win.lineIndex);
    setWinCells(winCells);
    setWinLines(lineWins);
    return { ...evaluation, lineIndexes, winCells };
  }, [speed]);

  const showServerPayout = useCallback((serverRound) => {
    const paid = coinsFromUsd(serverRound.payout);
    setWinAmount(paid);
    countUp(paid);
    if (paid > 0) sound.win(paid / Math.max(coinsFromUsd(serverRound.wager), 1));
    return paid;
  }, [countUp]);

  const runMaxWin = useCallback(async (serverPayout) => {
    sound.maxWin();
    const stages = ['board', 'files', 'clues', 'links'];
    for (const stage of stages) {
      setMaxWin({ stage });
      await sleep(speed(1000));
    }
    const amount = serverPayout ?? betRef.current * CONFIG.features.maxWin.multiplier;
    setMaxWin({ stage: 'solved', amount });
    setWinAmount(amount);
    countUp(amount);
    await sleep(speed(4600));
    setMaxWin(null);
  }, [countUp, speed]);

  const conductSpin = useCallback(async ({ mode = null } = {}) => {
    const currentBet = betRef.current;
    setWinCells([]);
    setWinLines([]);
    setBanner(null);
    setWinAmount(0);
    setDisplayWin(0);
    setSpinning(true);
    setStoppedReels(0);
    setSpinId(Date.now() + Math.random());
    sound.spin();

    const sticky = mode === 'sticky' ? stickyRef.current : [];
    let nextGrid = engine.generateGrid(sticky);
    let multiplier = 1;
    if (mode === 'surveillance') {
      nextGrid = engine.dropWilds(nextGrid, surveillanceWildCount());
      multiplier = surveillanceMultiplier();
      setFreeSpins((current) => (current ? { ...current, multiplier } : current));
    }
    setGrid(nextGrid);
    await sleep(speed(CONFIG.animation.reelStopDelay));
    for (let reel = 0; reel < CONFIG.reels; reel += 1) {
      setStoppedReels(reel + 1);
      sound.reelStop();
      await sleep(speed(CONFIG.animation.reelStagger));
    }
    await sleep(speed(CONFIG.animation.postStop));
    setSpinning(false);

    const evaluation = engine.evaluateGrid(nextGrid, currentBet);
    const total = evaluation.total * multiplier;
    if (total > 0) {
      setWinCells(evaluation.winCells);
      setWinLines(evaluation.wins);
      setWinAmount(total);
      countUp(total);
      sound.win(total / Math.max(currentBet, 0.01));
      await sleep(speed(CONFIG.animation.featurePause));
    }

    if (mode === 'sticky') {
      const merged = [...stickyRef.current];
      nextGrid.forEach((column, reel) => column.forEach((symbol, row) => {
        if (symbol === 'WILD' && !merged.some((spot) => spot.reel === reel && spot.row === row)) merged.push({ reel, row });
      }));
      stickyRef.current = merged.slice(0, getBonusChoice('sticky').stickyCap ?? merged.length);
      setFreeSpins((current) => (current ? { ...current, sticky: stickyRef.current } : current));
    }
    return { grid: nextGrid, evaluation, total, multiplier };
  }, [countUp, speed]);

  const runGooey = useCallback(async (currentGrid) => {
    sound.feature();
    setBanner({ tier: 'FEATURE', title: 'GOOEY IS GOOD', subtitle: 'The goo gun is spraying wilds across the reels' });
    setGooey({ stage: 'launch', spots: [] });
    await sleep(speed(900));
    const nextGrid = engine.dropWilds(currentGrid, gooeyWildCount());
    const spots = [];
    nextGrid.forEach((column, reel) => column.forEach((symbol, row) => {
      if (symbol === 'WILD' && currentGrid[reel][row] !== 'WILD') spots.push(`${reel}-${row}`);
    }));
    setGrid(nextGrid);
    setGooey({ stage: 'splatter', spots });
    await sleep(speed(1500));
    const evaluation = engine.evaluateGrid(nextGrid, betRef.current);
    if (evaluation.total > 0) {
      setWinCells(evaluation.winCells);
      setWinLines(evaluation.wins);
      setWinAmount(evaluation.total);
      countUp(evaluation.total);
      sound.win(evaluation.total / Math.max(betRef.current, 0.01));
      setBanner({
        tier: tierFor(evaluation.total, betRef.current) || 'FEATURE WIN',
        title: `${formatCoins(evaluation.total)} ${CONFIG.currency}`,
        subtitle: 'Gooey wilds paid out',
      });
      await sleep(speed(1300));
    }
    setGooey(null);
    setBusy(false);
  }, [countUp, setBusy, speed]);

  const animateServerGooey = useCallback(async (serverRound) => {
    const donut = serverRound.donutDivision;
    const enhanced = donut.bonusGrids[0];
    if (!enhanced) return showServerPayout(serverRound);
    sound.feature();
    setBanner({ tier: 'FEATURE', title: 'GOOEY IS GOOD', subtitle: 'The goo gun is spraying wilds across the reels' });
    setGooey({ stage: 'launch', spots: [] });
    await sleep(speed(900));
    const spots = [];
    enhanced.forEach((column, reel) => column.forEach((symbol, row) => {
      if (symbol === 'WILD' && donut.grid[reel]?.[row] !== 'WILD') spots.push(`${reel}-${row}`);
    }));
    setGrid(enhanced);
    setGooey({ stage: 'splatter', spots });
    await sleep(speed(1500));
    const evaluation = engine.evaluateGrid(enhanced, betRef.current);
    const serverLineWins = donut.bonusSpinWins[0]?.lineWins;
    setWinCells(serverLineWins
      ? getWinningCells(enhanced, serverLineWins)
      : evaluation.winCells);
    setWinLines(serverLineWins ?? evaluation.wins);
    setGooey(null);
    showServerPayout(serverRound);
  }, [showServerPayout, speed]);

  const beginServerRound = useCallback(async () => {
    if (currency !== 'USD') throw new Error('Fizzcoin wagers currently require a USD wallet.');
    setSpinning(true);
    setStoppedReels(0);
    setSpinId(Date.now() + Math.random());
    sound.spin();
    const requestId = startRequestId.current ?? crypto.randomUUID();
    startRequestId.current = requestId;
    let result;
    try {
      result = await postGameAction({
        action: 'start',
        requestId,
        wagerCents: wagerCentsFromFizzcoins(betRef.current),
        expectedRtpBps: rtpBps,
      });
    } catch (error) {
      setSpinning(false);
      setStoppedReels(CONFIG.reels);
      throw error;
    }
    const serverRound = updateFromServer(result);
    const donut = serverRound.donutDivision;
    if (!donut) {
      setSpinning(false);
      setStoppedReels(CONFIG.reels);
      throw new Error('The server returned an incomplete Donut Division round.');
    }
    startRequestId.current = null;
    await animateServerGrid(donut.grid, true, donut.lineWins);
    if (donut.bonusStage === 'choose') {
      setBanner({ tier: 'BONUS', title: 'BONUS CHOICE', subtitle: 'Case files unlocked — choose your investigation' });
      setBonusChoice(true);
      return;
    }
    if (donut.feature === 'gooey') {
      await animateServerGooey(serverRound);
    } else if (donut.feature === 'maxWin') {
      await runMaxWin(coinsFromUsd(serverRound.payout));
    } else {
      showServerPayout(serverRound);
    }
  }, [animateServerGrid, animateServerGooey, currency, rtpBps, runMaxWin, showServerPayout, updateFromServer]);

  const doSpin = useCallback(async () => {
    if (busy.current) return;
    if (!demoRef.current && balance < betRef.current) {
      setMessage('You need enough Fizzcoins to place this wager.');
      setAutoplayLeft(0);
      return;
    }
    setBusy(true);
    setMessage('');
    setWinCells([]);
    setWinLines([]);
    setWinAmount(0);
    setDisplayWin(0);
    try {
      if (!demoRef.current) {
        await beginServerRound();
        return;
      }
      const result = await conductSpin({});
      if (result.evaluation.scatterCount >= CONFIG.features.bonus.minScatters) {
        sound.feature();
        setBanner({ tier: 'BONUS', title: 'BONUS CHOICE', subtitle: 'Case files unlocked — choose your investigation' });
        setBonusChoice(true);
        return;
      }
      const roll = engine.rollRandomFeature();
      if (roll === 'maxWin') {
        await runMaxWin();
        return;
      }
      if (roll === 'gooey') {
        await runGooey(result.grid);
        return;
      }
    } catch (error) {
      setSpinning(false);
      setStoppedReels(CONFIG.reels);
      setMessage(error instanceof Error ? error.message : 'The game could not complete that spin.');
    } finally {
      setBusy(false);
    }
  }, [balance, beginServerRound, conductSpin, runGooey, runMaxWin, setBusy]);

  const startPickBonus = useCallback(() => {
    const cards = buildClueCards();
    const state = { cards, picks: 0, total: 0 };
    pickRef.current = state;
    setPickBonus(state);
    setBanner({ tier: 'BONUS', title: getBonusChoice('pick').title, subtitle: 'Tap 3 clue cards to reveal prizes' });
    sound.feature();
  }, []);

  const pickCard = useCallback(async (cardId) => {
    const current = pickRef.current;
    if (!current || busy.current) return;
    const card = current.cards.find((entry) => entry.id === cardId);
    if (!card || card.revealed || current.picks >= getBonusChoice('pick').picks) return;

    if (!demoRef.current) {
      const position = Number(card.position ?? String(card.id).replace('card-', ''));
      const requestId = pickRequestIds.current.get(position) ?? crypto.randomUUID();
      pickRequestIds.current.set(position, requestId);
      setBusy(true);
      setMessage('');
      try {
        const result = await postGameAction({ action: 'pick', sessionId: round.sessionId, requestId, position });
        const serverRound = updateFromServer(result);
        pickRequestIds.current.delete(position);
        const next = pickStateFromRound(serverRound, coinsFromUsd(serverRound.wager));
        pickRef.current = next;
        setPickBonus(next);
        sound.collect();
        if (serverRound.status === 'settled') {
          const paid = showServerPayout(serverRound);
          setPickBonus(null);
          pickRef.current = null;
          setBanner({ tier: 'FEATURE COMPLETE', title: `${formatCoins(paid)} ${CONFIG.currency}`, subtitle: 'Case files collected' });
          sound.bigWin();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The case file could not be opened.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const cards = current.cards.map((entry) => (entry.id === cardId ? { ...entry, revealed: true } : entry));
    const total = current.total + card.value * betRef.current;
    const next = { ...current, cards, picks: current.picks + 1, total };
    pickRef.current = next;
    setPickBonus(next);
    sound.collect();
    if (next.picks >= getBonusChoice('pick').picks) {
      setTimeout(() => {
        setWinAmount(total);
        countUp(total);
        setPickBonus(null);
        pickRef.current = null;
        setBanner({ tier: 'FEATURE COMPLETE', title: `${formatCoins(total)} ${CONFIG.currency}`, subtitle: 'Case files collected' });
        sound.bigWin();
        setBusy(false);
      }, 1100);
    }
  }, [countUp, round, setBusy, showServerPayout, updateFromServer]);

  const runDemoFreeSpins = useCallback(async (bonusId) => {
    const choice = getBonusChoice(bonusId);
    stickyRef.current = [];
    setFreeSpins({ id: bonusId, title: choice.title, remaining: choice.spins, total: choice.spins, multiplier: 1, totalWin: 0, sticky: [] });
    let totalWin = 0;
    for (let index = 0; index < choice.spins; index += 1) {
      setFreeSpins((current) => (current ? { ...current, remaining: choice.spins - index } : current));
      const result = await conductSpin({ mode: bonusId });
      totalWin += result.total;
      setFreeSpins((current) => (current ? { ...current, totalWin } : current));
      await sleep(speed(500));
    }
    setFreeSpins(null);
    stickyRef.current = [];
    setBanner({ tier: 'FEATURE COMPLETE', title: `${formatCoins(totalWin)} ${CONFIG.currency}`, subtitle: 'Free spins complete' });
    sound.bigWin();
  }, [conductSpin, speed]);

  const runServerFreeSpins = useCallback(async (serverRound, choice) => {
    const donut = serverRound.donutDivision;
    const grids = donut.bonusGrids;
    const total = grids.length;
    const title = getBonusChoice(choice).title;
    let sticky = [];
    setFreeSpins({ id: choice, title, remaining: total, total, multiplier: 1, totalWin: 0, sticky });
    for (let index = 0; index < total; index += 1) {
      const multiplier = donut.bonusMultipliers[index] ?? 1;
      setFreeSpins((current) => current ? { ...current, remaining: total - index, multiplier, sticky } : current);
      await animateServerGrid(grids[index]);
      if (choice === 'sticky') {
        grids[index].forEach((column, reel) => column.forEach((symbol, row) => {
          if (symbol === 'WILD' && sticky.length < 3 && !sticky.some((spot) => spot.reel === reel && spot.row === row)) sticky.push({ reel, row });
        }));
      }
      await sleep(speed(500));
    }
    setFreeSpins(null);
    setBanner({ tier: 'FEATURE COMPLETE', title: `${formatCoins(coinsFromUsd(serverRound.payout))} ${CONFIG.currency}`, subtitle: 'Free spins complete' });
    showServerPayout(serverRound);
    sound.bigWin();
  }, [animateServerGrid, showServerPayout, speed]);

  const selectBonus = useCallback(async (bonusId) => {
    setBonusChoice(false);
    sound.click();
    setBusy(true);
    if (demoRef.current) {
      if (bonusId === 'pick') {
        startPickBonus();
        setBusy(false);
        return;
      }
      await runDemoFreeSpins(bonusId);
      setBusy(false);
      return;
    }
    const requestId = bonusRequestId.current ?? crypto.randomUUID();
    bonusRequestId.current = requestId;
    try {
      const result = await postGameAction({ action: 'bonus', sessionId: round.sessionId, requestId, choiceId: bonusId });
      bonusRequestId.current = null;
      const serverRound = updateFromServer(result);
      if (bonusId === 'pick') {
        setBanner({ tier: 'BONUS', title: getBonusChoice('pick').title, subtitle: 'Tap 3 clue cards to reveal prizes' });
        return;
      }
      await runServerFreeSpins(serverRound, bonusId);
    } catch (error) {
      setBonusChoice(true);
      setMessage(error instanceof Error ? error.message : 'The bonus choice could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [round, runDemoFreeSpins, runServerFreeSpins, setBusy, startPickBonus, updateFromServer]);

  const changeBet = useCallback((direction) => {
    setBet((current) => {
      const options = CONFIG.bets.options;
      const index = options.indexOf(current);
      return options[Math.min(Math.max(index + direction, 0), options.length - 1)];
    });
    sound.click();
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplayLeft((current) => current > 0 ? 0 : 25);
    sound.click();
  }, []);
  const toggleQuickSpin = useCallback(() => setQuickSpin((current) => !current), []);
  const toggleSound = useCallback(() => setSoundOn((current) => !current), []);

  const gameActive = !spinning && !bonusChoice && !pickBonus && !freeSpins && !maxWin;
  const canAfford = demo || balance >= bet;
  const canSpin = gameActive && !gooey && !actionBusy;

  useEffect(() => {
    if (autoplayLeft <= 0 || !gameActive || actionBusy) return undefined;
    if (!canAfford) {
      setAutoplayLeft(0);
      return undefined;
    }
    const timer = setTimeout(async () => {
      await doSpin();
      setAutoplayLeft((current) => Math.max(0, current - 1));
    }, 700);
    return () => clearTimeout(timer);
  }, [actionBusy, autoplayLeft, gameActive, canAfford, doSpin]);

  return {
    bet,
    changeBet,
    balance,
    grid,
    spinId,
    spinning,
    stoppedReels,
    winCells,
    winLines,
    winAmount,
    displayWin,
    banner,
    setBanner,
    gooey,
    bonusChoice,
    selectBonus,
    freeSpins,
    pickBonus,
    pickCard,
    maxWin,
    autoplayLeft,
    toggleAutoplay,
    quickSpin,
    toggleQuickSpin,
    soundOn,
    toggleSound,
    message,
    canSpin,
    canAfford,
    spin: doSpin,
    demo,
    rtp: ((round?.rtpBps ?? rtpBps) / 100),
  };
}
