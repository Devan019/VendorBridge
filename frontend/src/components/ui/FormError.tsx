import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  error: string | string[] | null | undefined;
  className?: string;
}

export function FormError({ error, className = '' }: FormErrorProps) {
  if (!error || (Array.isArray(error) && error.length === 0)) {
    return null;
  }

  return (
    <div className={`bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-start gap-3 ${className}`}>
      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
      <div className="flex-1">
        {Array.isArray(error) ? (
          <ul className="list-disc list-inside space-y-1">
            {error.map((err, idx) => (
              <li key={idx} className="text-sm font-medium leading-relaxed">{err}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        )}
      </div>
    </div>
  );
}
