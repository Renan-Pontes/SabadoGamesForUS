import type { HalloweenViewProps } from '../../engine/types'
import { PlaceholderPhone } from '../../framework/Placeholder'
import type { State } from './engine'
import { meta } from './meta'

/** PLACEHOLDER — a Etapa 2 troca pelo celular de verdade. */
export default function Phone(props: HalloweenViewProps<State>) {
  return <PlaceholderPhone {...props} meta={meta} />
}
