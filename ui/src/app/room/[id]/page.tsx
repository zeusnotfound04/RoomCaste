import Room from "@/components/Room"

export default async  function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
    const {id} = await params;
  
    return (
        <Room roomId={id} />
    );
}
