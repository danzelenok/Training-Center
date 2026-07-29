import Image from "next/image";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 text-center sm:px-6 lg:px-8">
      <Image
        src="/cool-cat_logo-color.svg"
        alt="Cool Cat Logo"
        width={72}
        height={72}
        className="object-contain"
      />
      <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-[#1B2A6B]">
        You don&apos;t have access to this workspace
      </h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">
        Please contact your administrator for access.
      </p>
    </div>
  );
}
