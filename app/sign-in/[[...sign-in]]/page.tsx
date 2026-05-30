import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="text-center flex flex-col items-center">
          <Image
            src="/cool-cat_logo-color.svg"
            alt="Cool Cat Logo"
            width={72}
            height={72}
            className="object-contain"
          />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-[#1B2A6B] sm:text-4xl">
            Cool Cat Training
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">
            Safety Portal. Sign in to construct modules & examine worker reports.
          </p>
        </div>

        <div className="w-full mt-8 flex justify-center">
          <SignIn
            appearance={{
              variables: {
                colorPrimary: "#C8D400",
                colorBackground: "#ffffff",
                colorInputBackground: "#f9fafb",
                colorText: "#1B2A6B",
                colorTextSecondary: "#4B5563",
                colorInputText: "#1F2937",
                colorBorder: "#E5E7EB",
              },
              elements: {
                card: "bg-white border border-[#E5E7EB] shadow-lg rounded-3xl p-6",
                headerTitle: "text-[#1B2A6B] text-xl font-extrabold",
                headerSubtitle: "text-gray-500 text-sm",
                socialButtonsIconButton: "bg-gray-50 border-[#E5E7EB] hover:bg-gray-100 text-[#1B2A6B]",
                formButtonPrimary: "bg-[#C8D400] text-[#1B2A6B] hover:bg-[#B6C200] border-none font-bold shadow-md",
                formFieldLabel: "text-[#1B2A6B] text-xs font-semibold",
                formFieldInput: "bg-gray-50 border-[#E5E7EB] focus:border-[#C8D400] text-gray-900 placeholder-gray-400",
                footerActionText: "text-gray-500",
                footerActionLink: "text-[#1B2A6B] hover:underline font-bold",
                dividerLine: "bg-[#E5E7EB]",
                dividerText: "text-gray-400 text-xs uppercase",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
