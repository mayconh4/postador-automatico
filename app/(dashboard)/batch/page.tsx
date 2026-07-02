"use client";

import { useState } from "react";
import { Layers, LayoutTemplate, PlusCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewBatchTab } from "@/components/batch/new-batch-tab";
import { TemplatesTab } from "@/components/batch/templates-tab";
import { JobsTab } from "@/components/batch/jobs-tab";

export default function BatchPage() {
  const [tab, setTab] = useState("novo");
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div>
      <PageHeader
        title="Batch Edit"
        description="Envie vídeos em massa, aplique um template e exporte tudo de uma vez."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="novo" className="gap-2">
            <PlusCircle className="h-4 w-4" /> Novo Lote
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="lotes" className="gap-2">
            <Layers className="h-4 w-4" /> Lotes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="mt-4">
          <NewBatchTab
            onCreated={() => {
              setRefreshToken((n) => n + 1);
              setTab("lotes");
            }}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesTab onChanged={() => setRefreshToken((n) => n + 1)} />
        </TabsContent>

        <TabsContent value="lotes" className="mt-4">
          <JobsTab refreshToken={refreshToken} onGoToNew={() => setTab("novo")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
