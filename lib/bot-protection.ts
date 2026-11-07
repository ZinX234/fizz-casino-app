const ALLOWED_CRAWLER_MARKERS = [
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'applebot',
  'googlebot',
  'google-extended',
  'bingbot',
  'duckduckbot',
  'facebookexternalhit',
  'meta-externalagent',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
]

const BLOCKED_AUTOMATION_MARKERS = [
  'headlesschrome',
  'phantomjs',
  'selenium',
  'puppeteer',
  'playwright',
  'sqlmap',
  'nikto',
  'nmap',
  'masscan',
  'zgrab',
  'scrapy',
  'crawler',
  'spider',
  'scraper',
  'httpclient',
  'libwww-perl',
  'python-requests',
]

export function isAllowedCrawler(userAgent: string) {
  const ua = userAgent.toLowerCase()
  return ALLOWED_CRAWLER_MARKERS.some((marker) => ua.includes(marker))
}

export function shouldBlockUserAgent(userAgent: string | null) {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  if (isAllowedCrawler(ua)) return false
  return BLOCKED_AUTOMATION_MARKERS.some((marker) => ua.includes(marker))
}

export function hasSuspiciousPath(requestUrl: URL) {
  const value = `${requestUrl.pathname}${requestUrl.search}`.toLowerCase()
  return (
    /(?:\.\.|%2e%2e|\/\/)/.test(value)
    || /(?:union(?:%20|\s|\+)+select|(?:sleep|benchmark)\s*\(|<script|javascript:)/.test(value)
  )
}
