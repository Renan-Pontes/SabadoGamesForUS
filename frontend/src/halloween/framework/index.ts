/**
 * O framework da TV-juiz. Para as telas dos jogos, o que interessa é o
 * relógio (`useServerNow`, `useCountdown`); o resto é usado pela
 * HalloweenGameScreen e pelos testes ponta a ponta.
 */
export { useCountdown, useServerNow } from './clockHooks'
export { useHalloweenRoom, JUDGE_TICK_MS, PHONE_POLL_MS, TV_POLL_MS } from './useHalloweenRoom'
export type { HalloweenRoomApi, HalloweenRoomGame } from './useHalloweenRoom'
export {
  authorityStep,
  canJudge,
  isTvDevice,
  HOST_GRACE_MS,
  LEASE_MS,
  RENEW_WHEN_LEFT_MS,
} from './authority'
export type { AuthorityInput, AuthorityResult, JudgeDevice, JudgeKind } from './authority'
export {
  collectInputs,
  isFresh,
  isInput,
  pendingCommand,
  readRoomState,
  stableStringify,
  toHPlayers,
} from './roomState'
export type { HalloweenRoomState } from './roomState'
export { judgeDeviceId } from './device'
