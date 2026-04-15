import { type FC } from 'react';
import '../../styles/AccessPointMap.css';

interface IAccessPointTriggerProps {
  accessPointName: string;
  className: string;
  canOpen: boolean;
  onOpen: (accessPointName: string) => Promise<void> | void;
}

export const AccessPointTrigger: FC<IAccessPointTriggerProps> = ({
  accessPointName,
  className,
  canOpen,
  onOpen,
}) => {
  if (!canOpen) {
    return <span className={className}>{accessPointName}</span>;
  }

  return (
    <button
      type="button"
      className={`skud-map-point-button skud-map-point-button--interactive ${className}`}
      onClick={event => {
        event.stopPropagation();
        void onOpen(accessPointName);
      }}
      title="Открыть карту точки доступа"
    >
      {accessPointName}
    </button>
  );
};
