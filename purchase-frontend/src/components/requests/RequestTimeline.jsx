import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Clock3, UserRound } from "lucide-react";
import { matchesSearchTokens } from "../../utils/search";
import "./RequestTimeline.css";

const timestamp = (value) => (value ? Date.parse(value) : NaN);
export function filterTimeline(
  events,
  { query = "", type = "all", status = "all", sort = "newest" } = {},
) {
  return events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        (type === "all" || event.event_type === type) &&
        (status === "all" || event.status === status) &&
        matchesSearchTokens(query, [
          event.title,
          event.description,
          event.actor_name,
          event.status,
          event.event_type,
        ]),
    )
    .sort((a, b) => {
      const first = timestamp(a.event.event_time),
        second = timestamp(b.event.event_time);
      if (!Number.isFinite(first) && !Number.isFinite(second))
        return a.index - b.index;
      if (!Number.isFinite(first)) return 1;
      if (!Number.isFinite(second)) return -1;
      return (
        (sort === "oldest" ? first - second : second - first) ||
        a.index - b.index
      );
    })
    .map(({ event }) => event);
}

const eventTone = (event) => {
  const status = String(event.status || "").toLowerCase();
  if (
    ["approved", "completed", "paid", "purchased", "received"].includes(status)
  )
    return "success";
  if (["rejected", "cancelled", "canceled", "failed"].includes(status))
    return "danger";
  if (["pending", "on hold", "on_hold"].includes(status)) return "pending";
  return "neutral";
};

export default function RequestTimeline({ events }) {
  const { t, i18n } = useTranslation();
  const tr = (key, fallback, options = {}) =>
    t(`requestTimeline.${key}`, { defaultValue: fallback, ...options });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const types = useMemo(
    () => [...new Set(events.map((event) => event.event_type).filter(Boolean))],
    [events],
  );
  const statuses = useMemo(
    () => [...new Set(events.map((event) => event.status).filter(Boolean))],
    [events],
  );
  const visible = useMemo(
    () => filterTimeline(events, { query, type, status, sort }),
    [events, query, type, status, sort],
  );
  const formatTime = (value) => {
    const time = timestamp(value);
    return Number.isFinite(time)
      ? new Intl.DateTimeFormat(i18n.language || "en", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(time)
      : tr("unknownTime", "Date not provided");
  };
  const reset = () => {
    setQuery("");
    setType("all");
    setStatus("all");
  };

  return (
    <section
      className="request-history"
      aria-labelledby="request-history-heading"
    >
      <header className="request-history-header">
        <div>
          <h2 id="request-history-heading">
            {tr("title", "Request timeline")}
          </h2>
          <p>
            {tr(
              "subtitle",
              "Follow the recorded approvals, procurement updates and request activity.",
            )}
          </p>
        </div>
        <Clock3 size={22} aria-hidden="true" />
      </header>
      {events.length > 0 && (
        <div className="request-history-filters print:hidden">
          <label className="request-history-search" htmlFor="timeline-search">
            {tr("search", "Search history")}
            <div>
              <Search size={16} aria-hidden="true" />
              <input
                id="timeline-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tr(
                  "searchPlaceholder",
                  "Event, person, status or keyword",
                )}
              />
            </div>
          </label>
          <label htmlFor="timeline-type">
            {tr("type", "Event type")}
            <select
              id="timeline-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">{tr("allTypes", "All event types")}</option>
              {types.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="timeline-status">
            {tr("status", "Status")}
            <select
              id="timeline-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">{tr("allStatuses", "All statuses")}</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="timeline-sort">
            {tr("sort", "Order")}
            <select
              id="timeline-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">{tr("newest", "Newest first")}</option>
              <option value="oldest">{tr("oldest", "Oldest first")}</option>
            </select>
          </label>
        </div>
      )}
      <div className="request-history-results">
        <p role="status">
          {tr("count", "Showing {{visible}} of {{total}} events", {
            visible: visible.length,
            total: events.length,
          })}
        </p>
        {(query || type !== "all" || status !== "all") && (
          <button type="button" onClick={reset} className="print:hidden">
            {tr("reset", "Clear filters")}
          </button>
        )}
      </div>
      {visible.length ? (
        <ol className="request-history-list">
          {visible.map((event, index) => (
            <li
              key={event.id ?? index}
              className={`request-history-event request-history-event--${eventTone(event)}`}
            >
              <span className="request-history-dot" aria-hidden="true" />
              <article>
                <div className="request-history-event-heading">
                  <h3>{event.title}</h3>
                  {(event.status || event.event_type) && (
                    <span className="request-history-badge">
                      {event.status || event.event_type}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="request-history-description">
                    {event.description}
                  </p>
                )}
                <div className="request-history-meta">
                  <span>
                    <UserRound size={13} aria-hidden="true" />
                    {event.actor_name || tr("system", "System")}
                  </span>
                  {Number.isFinite(timestamp(event.event_time)) ? (
                    <time dateTime={new Date(event.event_time).toISOString()}>
                      {formatTime(event.event_time)}
                    </time>
                  ) : (
                    <span>{formatTime(event.event_time)}</span>
                  )}
                  {event.event_type && (
                    <span className="request-history-type">
                      {event.event_type}
                    </span>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="request-history-empty">
          {events.length
            ? tr(
                "noMatches",
                "No events match these filters. Clear them to see the complete history.",
              )
            : tr("empty", "No timeline events found.")}
        </p>
      )}
    </section>
  );
}
