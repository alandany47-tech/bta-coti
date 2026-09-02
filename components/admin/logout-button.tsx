export function LogoutButton() {
  return (
    <form action="/api/admin/logout" method="post">
      <button
        type="submit"
        className="text-sm text-muted hover:text-foreground"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
