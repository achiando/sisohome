import { AuthGuard } from '@workspace/auth-ui';
import { useAuth } from '@workspace/auth-ui';

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Welcome, {user?.name}</h2>
        <p className="text-gray-600 mb-4">Email: {user?.email}</p>
        <div className="mb-4">
          <h3 className="font-medium mb-2">Permissions:</h3>
          <ul className="list-disc list-inside">
            {user?.permissions?.map((perm) => (
              <li key={perm}>{perm}</li>
            ))}
          </ul>
        </div>
        <div className="mb-4">
          <h3 className="font-medium mb-2">Roles:</h3>
          <ul className="list-disc list-inside">
            {user?.roles?.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard redirectTo="/login">
      <DashboardContent />
    </AuthGuard>
  );
}
