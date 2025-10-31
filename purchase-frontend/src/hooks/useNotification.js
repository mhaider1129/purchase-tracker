import { useNotificationContext } from '../components/ui/NotificationProvider';

export const useNotification = () => {
  return useNotificationContext();
};

export default useNotification;