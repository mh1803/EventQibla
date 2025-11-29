import React, { useState, useEffect, useCallback } from "react";
import { isCardExpired } from "../../backend/utils/isCardExpired.js";
import { PaymentErrors, PaymentFormProps } from "../../types/payment.js";
export const PaymentForm: React.FC<PaymentFormProps> = ({
  disabled,
  onDetailsChange,
  onErrorsChange,
}) => {
  const [bankCard, setBankCard] = useState<string>("");
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [cvc, setCvc] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");
  const [errors, setErrors] = useState<PaymentErrors>({
    bankCard: "",
    expirationDate: "",
    cvc: "",
    zipCode: "",
  });

  // Validate UK postcode format
  const validateUKPostcode = useCallback((postcode: string): boolean => {
    const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]? \d[A-Z]{2}$/i;
    return ukPostcodeRegex.test(postcode);
  }, []);

  // Handle bank card input changes
  const handleBankCardChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      const formattedValue = value
        .replace(/(\d{4})(\d{0,4})(\d{0,4})(\d{0,4})/, "$1 $2 $3 $4")
        .trim();
      setBankCard(formattedValue);

      setErrors((prev) => ({
        ...prev,
        bankCard:
          value.length === 16 ? "" : "Bank card number must be 16 digits",
      }));
    },
    []
  );

  // Handle expiration date input changes
  const handleExpirationDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      const formattedValue = value
        .replace(/(\d{2})(\d{0,2})/, "$1/$2")
        .substring(0, 5);
      setExpirationDate(formattedValue);

      if (!/^\d{2}\/\d{2}$/.test(formattedValue)) {
        setErrors((prev) => ({ ...prev, expirationDate: "Format: MM/YY" }));
        return;
      }

      const [monthStr, yearStr] = formattedValue.split("/");
      const month = parseInt(monthStr, 10);

      let error = "";
      if (month < 1 || month > 12) {
        error = "Month must be between 01-12";
      } else if (isCardExpired(formattedValue)) {
        error = "Card has expired";
      }

      setErrors((prev) => ({ ...prev, expirationDate: error }));
    },
    []
  );

  // Handle CVC input changes
  const handleCvcChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      setCvc(value);
      setErrors((prev) => ({
        ...prev,
        cvc:
          value.length >= 3 && value.length <= 4
            ? ""
            : "CVC must be 3-4 digits",
      }));
    },
    []
  );

  // Handle postal code input changes
  const handleZipCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toUpperCase();
      setZipCode(value);
      setErrors((prev) => ({
        ...prev,
        zipCode: validateUKPostcode(value) ? "" : "Invalid UK postal code",
      }));
    },
    [validateUKPostcode]
  );

  // Notify parent components of changes
  useEffect(() => {
    onDetailsChange({ bankCard, expirationDate, cvc, zipCode });
  }, [bankCard, expirationDate, cvc, zipCode, onDetailsChange]);

  useEffect(() => {
    onErrorsChange(errors);
  }, [errors, onErrorsChange]);

  return (
    <div className="payment-form">
      <div className="form-group">
        <label htmlFor="bankCard">
          Bank Card Number: <span className="red-asterisk">*</span>
        </label>
        <input
          type="text"
          id="bankCard"
          name="bankCard"
          value={bankCard}
          maxLength={19}
          onChange={handleBankCardChange}
          placeholder="1234 5678 9012 3456"
          disabled={disabled}
          aria-invalid={!!errors.bankCard}
          aria-describedby={errors.bankCard ? "bankCard-error" : undefined}
        />
        {errors.bankCard && (
          <p id="bankCard-error" className="error-message">
            {errors.bankCard}
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="expirationDate">
          Expiration Date (MM/YY): <span className="red-asterisk">*</span>
        </label>
        <input
          type="text"
          id="expirationDate"
          name="expirationDate"
          value={expirationDate}
          maxLength={5}
          onChange={handleExpirationDateChange}
          placeholder="MM/YY"
          disabled={disabled}
          aria-invalid={!!errors.expirationDate}
          aria-describedby={
            errors.expirationDate ? "expirationDate-error" : undefined
          }
        />
        {errors.expirationDate && (
          <p id="expirationDate-error" className="error-message">
            {errors.expirationDate}
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="cvc">
          CVC: <span className="red-asterisk">*</span>
        </label>
        <input
          type="text"
          id="cvc"
          name="cvc"
          value={cvc}
          maxLength={4}
          onChange={handleCvcChange}
          placeholder="123"
          disabled={disabled}
          aria-invalid={!!errors.cvc}
          aria-describedby={errors.cvc ? "cvc-error" : undefined}
        />
        {errors.cvc && (
          <p id="cvc-error" className="error-message">
            {errors.cvc}
          </p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="zipCode">
          Postal Code: <span className="red-asterisk">*</span>
        </label>
        <input
          type="text"
          id="zipCode"
          name="zipCode"
          value={zipCode}
          maxLength={8}
          onChange={handleZipCodeChange}
          placeholder="AA1 1AA"
          disabled={disabled}
          aria-invalid={!!errors.zipCode}
          aria-describedby={errors.zipCode ? "zipCode-error" : undefined}
        />
        {errors.zipCode && (
          <p id="zipCode-error" className="error-message">
            {errors.zipCode}
          </p>
        )}
      </div>
    </div>
  );
};
