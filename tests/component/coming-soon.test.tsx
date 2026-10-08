import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComingSoon } from "@/components/coming-soon";

afterEach(cleanup);

describe("ComingSoon", () => {
  it("shows the module title and description", () => {
    render(<ComingSoon title="Compras" description="Entradas de mercancía" />);
    expect(screen.getByRole("heading", { name: "Compras" })).toBeTruthy();
    expect(screen.getByText("Entradas de mercancía")).toBeTruthy();
  });
});
