const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) => {
  const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#1B6B3A] text-white hover:bg-[#145229] active:scale-95',
    accent: 'bg-[#F4A100] text-[#1A1A18] hover:bg-[#C07D00] active:scale-95',
    outline: 'border-2 border-[#1B6B3A] text-[#1B6B3A] hover:bg-[#D6EAE0] active:scale-95',
    danger: 'bg-[#C0390B] text-white hover:bg-red-800 active:scale-95',
    ghost: 'text-[#1B6B3A] hover:bg-[#D6EAE0] active:scale-95',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
    full: 'px-5 py-3 text-sm w-full',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Chargement...
        </span>
      ) : children}
    </button>
  );
};

export default Button;