import type { HalloweenViewProps } from '../../engine/types'
import { PlaceholderTv } from '../../framework/Placeholder'
import type { State } from './engine'
import { meta } from './meta'

/** PLACEHOLDER — a Etapa 2 troca pela TV de verdade. */
export default function Tv(props: HalloweenViewProps<State>) {
  return <PlaceholderTv {...props} meta={meta} />
}
