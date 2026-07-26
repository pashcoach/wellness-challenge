export default function BrandMark({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/fcl.svg"
      alt="Federated Co-operatives Limited"
      width={size}
      height={size}
      className="rounded-md"
    />
  );
}
