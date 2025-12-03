export interface PaymentDetails {
  bankCard: string;
  expirationDate: string;
  cvc: string;
  zipCode: string;
}

export interface PaymentErrors {
  bankCard: string;
  expirationDate: string;
  cvc: string;
  zipCode: string;
}

export interface PaymentFormProps {
  disabled: boolean;
  onDetailsChange: (details: PaymentDetails) => void;
  onErrorsChange: (errors: PaymentErrors) => void;
}
