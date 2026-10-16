/**
 * Co-located not-found boundary for /proyecto/[projectId].
 *
 * A group-level (portal)/not-found.tsx does NOT reliably render for notFound()
 * thrown inside this nested dynamic segment (Next leaves the shell <main>
 * empty). Co-locating the boundary here renders the human 404 inside the portal
 * shell. Re-exports the shared portal not-found content — no duplication.
 */
export { default } from '../../not-found';
