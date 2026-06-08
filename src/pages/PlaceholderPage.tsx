import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
}

export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        <Badge tone="pending">{phase}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-body">
            This page is a stub created during Phase&nbsp;1 scaffolding. The full implementation
            arrives in a later phase of the Waypoint PIT build plan.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
