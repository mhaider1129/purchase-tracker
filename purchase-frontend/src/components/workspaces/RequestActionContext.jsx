import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightCircle, UserRound, CircleAlert } from "lucide-react";

export default function RequestActionContext({ request }) {
  const { t } = useTranslation();
  const fields = [
    {
      key: "nextAction",
      value: request.next_required_action,
      Icon: ArrowRightCircle,
    },
    { key: "assignedTo", value: request.assigned_to_name, Icon: UserRound },
    { key: "bottleneck", value: request.current_bottleneck, Icon: CircleAlert },
  ];
  return (
    <section
      className="request-action-context print:hidden"
      aria-label={t("operationalWorkspace.actionContext")}
    >
      <dl>
        {fields.map(({ key, value, Icon }) => (
          <div key={key}>
            <dt>
              <Icon size={16} aria-hidden="true" />
              {t(`operationalWorkspace.${key}`)}
            </dt>
            <dd>{value || t("operationalWorkspace.notProvided")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
