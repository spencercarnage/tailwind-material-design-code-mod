import cx from "classnames";

export default function Foo({
  className,
  isActive,
}: {
  className: string;
  isActive: boolean;
}) {
  return (
    <div
      className={cx("text-primary-main", {
        "bg-primary-dark": isActive,
      })}
    >
      foo
      <span className={isActive ? "text-primary-light" : "text-primary-main"}>
        bar
      </span>
      <span className={`${className} text-primary-dark`}>baz</span>
      <span className={isActive && "text-primary-dark"}>quz</span>
    </div>
  );
}
