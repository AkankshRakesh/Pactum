import ContractEditor from "../../../components/ContractEditor";
import ContractReview from "../../../components/ContractReview";

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ review?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  return query.review === "1" ? <ContractReview contractId={id} /> : <ContractEditor contractId={id} />;
}
