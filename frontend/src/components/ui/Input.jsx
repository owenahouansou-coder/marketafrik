const Input = ({
  label,
  error,
  type = 'text',
  placeholder,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-[#1A1A18]">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-lg border text-sm text-[#1A1A18] bg-white
          placeholder-gray-400 outline-none transition-all duration-200
          ${error
            ? 'border-[#C0390B] focus:ring-2 focus:ring-red-200'
            : 'border-gray-200 focus:border-[#1B6B3A] focus:ring-2 focus:ring-[#D6EAE0]'
          } ${className}`}
        {...props}
      />
      {error && (
        <span className="text-xs text-[#C0390B]">{error}</span>
      )}
    </div>
  );
};

export default Input;