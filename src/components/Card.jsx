export default function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
      {children}
    </div>
  );
}
