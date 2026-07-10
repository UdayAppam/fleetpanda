import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Field, Input, Select } from './Field';

describe('Field', () => {
  it('associates the label with its child control', () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders an error with an alert role and hides the hint', () => {
    render(
      <Field label="Email" error="Required" hint="We never share it">
        <Input />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
  });

  it('renders the hint when there is no error', () => {
    render(
      <Field label="Email" hint="We never share it">
        <Input />
      </Field>,
    );
    expect(screen.getByText('We never share it')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Input / Select', () => {
  it('forwards a ref to the underlying input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="hi" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe('hi');
  });

  it('forwards a ref to the underlying select', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref}>
        <option value="a">A</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
