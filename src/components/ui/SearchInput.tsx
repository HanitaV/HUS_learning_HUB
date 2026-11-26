import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
} from 'react';
import { CloseIcon, SearchIcon } from './Icons';

export interface SearchInputProps {
  readonly id?: string;
  readonly name?: string;
  readonly toolparamdescription?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly placeholder: string;
  readonly label: string;
  readonly className?: string;
}

export function SearchInput({
  id,
  name,
  toolparamdescription,
  value,
  onChange,
  onKeyDown,
  placeholder,
  label,
  className = '',
}: SearchInputProps) {
  const [draftValue, setDraftValue] = useState(value);
  const isComposingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isComposingRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const nextValue = event.currentTarget.value;
    setDraftValue(nextValue);
    onChange(nextValue);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDraftValue(nextValue);
    const nativeEvent = event.nativeEvent as InputEvent;
    if (!isComposingRef.current && !nativeEvent.isComposing) {
      onChange(nextValue);
    }
  };

  const handleClear = () => {
    isComposingRef.current = false;
    setDraftValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        width={16}
        height={16}
        className="pointer-events-none absolute left-3 text-ink-muted"
      />
      <input
        ref={inputRef}
        id={id}
        name={name}
        toolparamdescription={toolparamdescription}
        type="search"
        value={draftValue}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-border bg-surface py-2 pl-9 pr-9 text-base text-ink placeholder:text-ink-muted transition-[border-color,background-color] duration-300 ease-[var(--hus-ease)] hover:border-border-strong focus:border-accent focus:outline-none sm:min-h-[40px] sm:text-sm"
      />
      {draftValue.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Xóa từ khóa tìm kiếm"
          className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted transition-colors duration-200 hover:bg-surface-subtle hover:text-ink active:scale-95"
        >
          <CloseIcon width={14} height={14} />
        </button>
      ) : null}
    </div>
  );
}
