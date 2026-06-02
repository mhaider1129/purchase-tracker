import React from "react";
import { formatAmountInputValue, normalizeAmountInputValue } from "../../utils/amountInputFormatter";

const AmountInput = React.forwardRef(({ inputMode = "decimal", onChange, value, ...props }, ref) => {
  const handleChange = (event) => {
    const normalizedValue = normalizeAmountInputValue(event.target.value);

    onChange?.({
      target: {
        id: event.target.id,
        name: event.target.name,
        value: normalizedValue,
      },
      currentTarget: {
        id: event.currentTarget.id,
        name: event.currentTarget.name,
        value: normalizedValue,
      },
    });
  };

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode}
      value={formatAmountInputValue(value)}
      onChange={handleChange}
    />
  );
});

AmountInput.displayName = "AmountInput";

export default AmountInput;