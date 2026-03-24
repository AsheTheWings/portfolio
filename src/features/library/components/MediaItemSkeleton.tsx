import Image from 'next/image';

const MediaItemSkeleton = () => {
  return (
    <div className="aspect-square bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
      <Image src="/image-down.svg" alt="Loading..." width={48} height={48} className="opacity-50" />
    </div>
  );
};

export default MediaItemSkeleton; 