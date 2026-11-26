import 'react';

declare module 'react' {
  interface FormHTMLAttributes<T> {
    toolname?: string | undefined;
    tooldescription?: string | undefined;
    toolautosubmit?: boolean | '' | undefined;
  }

  interface InputHTMLAttributes<T> {
    toolparamdescription?: string | undefined;
  }

  interface SelectHTMLAttributes<T> {
    toolparamdescription?: string | undefined;
  }

  interface TextareaHTMLAttributes<T> {
    toolparamdescription?: string | undefined;
  }
}
