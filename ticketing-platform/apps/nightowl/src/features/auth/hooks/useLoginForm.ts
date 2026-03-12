import { useCallback, useRef, useState } from "react";

import { useAuth } from "../../../core/auth/AuthProvider";
import { toAppError } from "../../../core/errors/appError";
import { authApi } from "../api/authApi";

type LoginFormState = {
  email: string;
  password: string;
};

const initialState: LoginFormState = { email: "", password: "" };

export function useLoginForm() {
  const { signIn } = useAuth();
  const [form, setForm] = useState<LoginFormState>(initialState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  function setEmail(email: string) {
    setForm((current) => ({ ...current, email }));
  }

  function setPassword(password: string) {
    setForm((current) => ({ ...current, password }));
  }

  const submit = useCallback(async () => {
    if (isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload = { ...form, email: form.email.trim() };
      const response = await authApi.login(payload);
      await signIn(response);
    } catch (e) {
      const appError = toAppError(e);
      setErrorMessage(appError.message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [form, signIn]);

  return {
    email: form.email,
    password: form.password,
    setEmail,
    setPassword,
    submit,
    isSubmitting,
    errorMessage,
  };
}
