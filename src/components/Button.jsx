const VARIANT_CLASSES = {
  primary: 'bg-primary text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  danger: 'bg-danger text-white hover:bg-red-700',
  success: 'bg-success text-white hover:bg-green-700',
};

export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`min-h-[44px] px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading ? 'Loading…' : children}
    </button>
  );
}
