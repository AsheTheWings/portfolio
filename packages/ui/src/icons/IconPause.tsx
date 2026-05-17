type PauseProps = {
  size: string;
};

const Pause = ({ size }: PauseProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="3" height="16" rx="0.5" />
    <rect x="15" y="4" width="3" height="16" rx="0.5" />
  </svg>
);

export default Pause;
