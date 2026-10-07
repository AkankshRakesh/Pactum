import ContractEditor from "../../../components/ContractEditor";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractEditor contractId={id} />;
}