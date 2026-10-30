import { useRef, useState } from 'react'
import {
  CopyButton,
  FormField,
  NativeSelect,
  NullableNumberField,
  NumberField,
  NumericRangeField,
  SelectField,
} from '@pgmaps/geo-toolkit/ui'

/** Exercises compiled public controls independently of any PG Maps adapters. */
export function ControlExperience() {
  const [required, setRequired] = useState(12)
  const [optional, setOptional] = useState<number | null>(7)
  const [committed, setCommitted] = useState(4)
  const [mode, setMode] = useState('compact')
  const [layers, setLayers] = useState<string[]>(['roads'])
  const [opacity, setOpacity] = useState(40)
  const [manual, setManual] = useState<string | null>(null)
  const select = useRef<HTMLSelectElement>(null)
  return (
    <main className="example-section" style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Shared controls</h1>
      <div style={{ display: 'grid', gap: 20 }}>
        <NumberField
          label="Required quantity"
          value={required}
          onValueChange={setRequired}
          min={0}
          max={100}
          step={0.5}
          description="An empty draft restores the previous quantity when committed."
          unit="m"
        />
        <output aria-label="Required value">{required}</output>
        <NullableNumberField
          label="Optional measurement"
          value={optional}
          onValueChange={setOptional}
          min={0}
          max={100}
          placeholder="Not measured"
          description="Clearing this measurement preserves a missing value."
        />
        <output aria-label="Optional value">{optional === null ? 'Missing' : optional}</output>
        <NumberField
          label="Committed quantity"
          value={committed}
          onValueChange={setCommitted}
          updateOn="commit"
          min={0}
          max={10}
          step={1}
          description="Apply typed changes on blur or Enter, bounded to 0–10."
        />
        <output aria-label="Committed value">{committed}</output>
        <NumericRangeField
          label="Layer opacity"
          value={opacity}
          onChange={setOpacity}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
        <output aria-label="Opacity value">{opacity}</output>
        <SelectField
          label="Display mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          description="The same native keyboard interaction works in app and embedded controls."
        >
          <option value="compact">Compact</option>
          <option value="expanded">Expanded</option>
        </SelectField>
        <output aria-label="Selected mode">{mode}</output>
        <FormField label="Visible layers" description="Native multiple selection and forwarded refs are retained.">
          <NativeSelect
            ref={select}
            multiple
            value={layers}
            onChange={(event) => setLayers(Array.from(event.target.selectedOptions, (option) => option.value))}
          >
            <option value="roads">Roads</option>
            <option value="water">Water</option>
            <option value="forest">Forest</option>
          </NativeSelect>
        </FormField>
        <button type="button" onClick={() => select.current?.focus()}>
          Focus layers
        </button>
        <output aria-label="Selected layers">{layers.join(', ')}</output>
        <CopyButton
          text="https://example.org/shared-view"
          options={{
            writeText: async () => {
              throw new Error('Clipboard access denied')
            },
          }}
          onResult={({ copied, text }) => setManual(copied ? null : text)}
        >
          Copy example link
        </CopyButton>
        {manual && (
          <FormField label="Copy link manually">
            <input readOnly value={manual} onFocus={(event) => event.currentTarget.select()} />
          </FormField>
        )}
      </div>
    </main>
  )
}
