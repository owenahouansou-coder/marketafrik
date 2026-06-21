import Button from '../ui/Button';

const EmptyState = ({ icon = '📭', title, description, action, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
      <span className="text-5xl">{icon}</span>
      <div>
        <h3 className="text-base font-semibold text-[#1A1A18] mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 max-w-xs">{description}</p>
        )}
      </div>
      {action && onAction && (
        <Button onClick={onAction}>{action}</Button>
      )}
    </div>
  );
};

export default EmptyState;