import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Crumb } from '../../lib/navigation';

export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <ChevronRight className="size-3 shrink-0 text-gold/50" aria-hidden />}
              <li className="min-w-0 truncate">
                {crumb.to && !isLast ? (
                  <Link to={crumb.to} className="transition-colors hover:text-gold-light">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'text-gold-light' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
