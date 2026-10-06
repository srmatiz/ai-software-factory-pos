import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder for modules listed in docs/roadmap.md.
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Este módulo está planificado en <code>docs/roadmap.md</code>.
        </CardContent>
      </Card>
    </div>
  );
}
