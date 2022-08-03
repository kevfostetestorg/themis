// export interface TeamData {
//   ref: string
//   node_id: string
//   url: string
//   object: {
//     type: string
//     sha: string
//     url: string
//   }
// }

export interface TeamData {
  name: string
}

export interface CollaboratorData {
  username: string
  pendinginvite: boolean
  invitation_id?: number
  permission: {pull: boolean; push: boolean; admin: boolean} | undefined
}

export interface RepositoryData {
  name: string
}
