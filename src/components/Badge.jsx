const TONE_CLASSES = {
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-success',
  warning: 'bg-amber-100 text-warning',
  danger: 'bg-red-100 text-danger',
};

export default function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
