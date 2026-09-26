import 'server-only'

import { databasePool } from '@/lib/db'

export interface PlayerProfile {
  username: string
  fizz_email: string
  paypal_first_name: string
  paypal_last_name: string
  paypal_email: string
}

export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const { rows } = await databasePool.query<PlayerProfile>(
    `SELECT username, fizz_email, paypal_first_name, paypal_last_name, paypal_email
     FROM public.user_profiles
     WHERE user_id = $1::uuid`,
    [userId],
  )
  return rows[0] ?? null
}

export async function getPlayerUsername(userId: string): Promise<string | null> {
  const { rows } = await databasePool.query<{ username: string }>(
    `SELECT username FROM public.user_profiles WHERE user_id = $1::uuid`,
    [userId],
  )
  return rows[0]?.username ?? null
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}

export function getProfileValidationMessage(error: unknown) {
  if (error instanceof Error && 'issues' in error) return 'Check the username, Fizz email, and PayPal details and try again.'
  return 'Your profile could not be saved. Please try again.'
}

export const profileFieldRules = {
  username: 'Use 3–20 letters, numbers, or underscores. Uppercase letters are allowed.',
} as const

export function normalizeUsername(username: string) {
  return username.trim()
}

export function validProfileUsername(username: string) {
  return /^[A-Za-z0-9_]{3,20}$/.test(username)
}

export function validProfileEmail(email: string) {
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validProfileName(name: string) {
  return name.trim().length >= 1 && name.trim().length <= 80
}

export function profileEmailMatchesSession(profileEmail: string, sessionEmail: string) {
  return profileEmail.trim().toLowerCase() === sessionEmail.trim().toLowerCase()
}

export function profileUsernameError() {
  return 'That Fizz username is unavailable. Choose another username and try again.'
}

export function profileEmailError() {
  return 'Fizz email must match the email used to sign in.'
}

export function profileNotFoundError() {
  return 'Finish setting up your Fizz profile before requesting a payment.'
}

export function validPaypalEmail(email: string) {
  return validProfileEmail(email)
}

export function isProfileMissing(error: unknown) {
  return error instanceof Error && error.message === 'Player profile is required'
}

export function duplicateProfileError() {
  return 'Your profile is already set up. Use account settings to make changes.'
}

export function safeProfileError() {
  return 'Your account profile could not be saved. Please try again.'
}

export function profileConflictError() {
  return 'That username is already in use. Choose a different one.'
}

export function profileResponseError() {
  return 'We could not update your account details. Check each field and try again.'
}

export function profileRequiredError() {
  return 'Complete your account profile before using wallet payments.'
}

export function profileSuccessMessage() {
  return 'Your account details have been saved.'
}

export function profileFormFieldsAreValid(profile: {
  username: string
  fizzEmail: string
  paypalFirstName: string
  paypalLastName: string
  paypalEmail: string
}) {
  return validProfileUsername(normalizeUsername(profile.username)) &&
    validProfileEmail(profile.fizzEmail) &&
    validProfileName(profile.paypalFirstName) &&
    validProfileName(profile.paypalLastName) &&
    validPaypalEmail(profile.paypalEmail)
}

export function usernameDisplayName(username: string | null | undefined, fallback = 'Player') {
  return username?.trim() || fallback
}

export function getUsernameFromProfile(profile: Pick<PlayerProfile, 'username'> | null, fallback = 'Player') {
  return usernameDisplayName(profile?.username, fallback)
}

export function getProfileEmail(profile: Pick<PlayerProfile, 'fizz_email'> | null) {
  return profile?.fizz_email ?? ''
}

export function getPaypalProfileDetails(profile: Pick<PlayerProfile, 'paypal_first_name' | 'paypal_last_name' | 'paypal_email'> | null) {
  return profile ? {
    firstName: profile.paypal_first_name,
    lastName: profile.paypal_last_name,
    email: profile.paypal_email,
  } : null
}

export function assertProfilePresent(profile: PlayerProfile | null): asserts profile is PlayerProfile {
  if (!profile) throw new Error('Player profile is required')
}
