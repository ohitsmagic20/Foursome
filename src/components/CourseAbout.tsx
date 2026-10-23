import type { CourseInfo } from '@/lib/shared';

/** What a course is like: a short description, who designed it, and what's there. */
export function CourseAbout({ info, open = false }: { info: Partial<CourseInfo>; open?: boolean }) {
  const facts = [info.architect ? `Designed by ${info.architect}` : '', info.built ? `opened ${info.built}` : '', info.yards ? `${info.yards.toLocaleString('en-US')} yards` : ''].filter(Boolean).join(', ');
  const has = info.description || facts || info.facilities?.length;
  if (!has) return null;
  const body = (
    <div className="about-body">
      {info.description && <p>{info.description} {info.descriptionUrl && <a href={info.descriptionUrl} target="_blank" rel="noopener noreferrer">Wikipedia</a>}</p>}
      {facts && <p className="row-meta">{facts.charAt(0).toUpperCase() + facts.slice(1)}.</p>}
      {!!info.facilities?.length && <p className="row-meta">{info.facilities.join(' · ')}</p>}
    </div>
  );
  return open ? <div className="about">{body}</div> : <details className="about"><summary>About this course</summary>{body}</details>;
}
