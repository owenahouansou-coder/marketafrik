const Loader = ({ text = 'Chargement...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-[#D6EAE0] border-t-[#1B6B3A] rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
};

export default Loader;