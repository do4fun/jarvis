'use client'

import Avatar from './Avatar'
import AvatarFuturiste from './AvatarFuturiste'

interface Props {
  characterName: string
}

export default function AvatarSelector({ characterName }: Props) {
  if (characterName === 'Futuriste') return <AvatarFuturiste characterName={characterName} />
  return <Avatar />
}
