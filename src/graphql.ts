import { GraphQLBoolean, GraphQLError, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql'
import { InputError, type IntakeService } from './services/intake.js'

const RequestType_ = new GraphQLObjectType({
  name: 'ChangeRequest',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    client: { type: new GraphQLNonNull(GraphQLString) },
    message: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: GraphQLString },
    priority: { type: GraphQLInt },
    assignee: { type: GraphQLString },
    reason: { type: GraphQLString },
  },
})

/** GraphQL API in front of the intake service. Reads come from the service, writes become events. */
export function buildSchema(service: IntakeService) {
  const Query = new GraphQLObjectType({
    name: 'Query',
    fields: {
      health: { type: GraphQLBoolean, resolve: () => true },
      requests: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RequestType_))),
        args: { status: { type: GraphQLString } },
        resolve: (_r, args: { status?: string }) => [...service.requests.values()].filter((r) => !args.status || r.status === args.status),
      },
      request: {
        type: RequestType_,
        args: { id: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (_r, args: { id: string }) => service.requests.get(args.id) ?? null,
      },
    },
  })
  const Mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      submitRequest: {
        type: new GraphQLNonNull(RequestType_),
        args: { client: { type: new GraphQLNonNull(GraphQLString) }, message: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: async (_r, args: { client: string; message: string }) => {
          try {
            return await service.submit(args)
          } catch (err) {
            if (err instanceof InputError) throw new GraphQLError(err.message, { extensions: { code: 'BAD_USER_INPUT' } })
            throw err
          }
        },
      },
    },
  })
  return new GraphQLSchema({ query: Query, mutation: Mutation })
}
