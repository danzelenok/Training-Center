import { OrganizationProfile } from "@clerk/nextjs";

export default function TeamSettingsPage() {
  return (
    <div className="flex justify-center">
      <OrganizationProfile
        appearance={{
          variables: { colorPrimary: "#C8D400" },
        }}
      />
    </div>
  );
}
