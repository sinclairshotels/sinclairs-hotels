import { DEFAULT_COUNTRY } from '@/lib/address';

// The six fields a guest address is written in, shared by the booking form and
// the voucher form so the two cannot drift into different shapes — and so what
// `cityOf` reads back is what both of them wrote.
//
// A plain component, not a client one: it is inputs and labels, and the forms
// that hold it already own whatever state there is.
export function AddressFields({
  values,
  errors,
  required = true,
  autoComplete = true,
  Field,
}: {
  values?: Partial<Record<AddressFieldName, string>>;
  errors?: Partial<Record<AddressFieldName, string>>;
  required?: boolean;
  // Off inside the admin, where staff are typing a guest's address and the
  // browser would offer them their own.
  autoComplete?: boolean;
  // The surrounding form's own label-and-error wrapper, so the block looks
  // native wherever it lands rather than bringing its own styling.
  Field: (props: {
    label: string;
    name: string;
    error?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
}) {
  const field = (
    name: AddressFieldName,
    label: string,
    options: { autoComplete: string; required?: boolean; placeholder?: string } = {
      autoComplete: 'off',
    },
  ) => (
    <Field key={name} label={label} name={name} error={errors?.[name]}>
      <input
        id={name}
        name={name}
        type="text"
        required={options.required ?? required}
        autoComplete={autoComplete ? options.autoComplete : 'off'}
        placeholder={options.placeholder}
        // `||`, not `??`: a sticky value handed back from a refused
        // submission is an empty string when the guest typed nothing, and the
        // country should come back filled in rather than blank.
        defaultValue={values?.[name] || (name === 'country' ? DEFAULT_COUNTRY : '')}
        className="input"
      />
    </Field>
  );

  return (
    <>
      {field('addressLine1', 'Address line 1', { autoComplete: 'address-line1' })}
      {field('addressLine2', 'Address line 2 (optional)', {
        autoComplete: 'address-line2',
        required: false,
      })}
      {field('city', 'City', { autoComplete: 'address-level2' })}
      {field('state', 'State', { autoComplete: 'address-level1' })}
      {field('pin', 'PIN code', { autoComplete: 'postal-code' })}
      {field('country', 'Country', { autoComplete: 'country-name' })}
    </>
  );
}

export type AddressFieldName =
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'state'
  | 'pin'
  | 'country';

export const ADDRESS_FIELD_NAMES: AddressFieldName[] = [
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pin',
  'country',
];
