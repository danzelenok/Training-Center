import { OrganizationList } from "@clerk/nextjs";

export default function InvitePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 sm:px-6 lg:px-8">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/admin"
        appearance={{
          variables: { colorPrimary: "#C8D400" },
        }}
      />
    </div>
  );
}
