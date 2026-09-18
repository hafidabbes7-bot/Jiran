package dz.peintrepro.data.repository

import dz.peintrepro.data.local.dao.ClientDao
import dz.peintrepro.data.local.entity.ClientEntity
import kotlinx.coroutines.flow.Flow

class ClientRepository(private val clientDao: ClientDao) {

    fun observeAll(): Flow<List<ClientEntity>> = clientDao.observeAll()

    fun search(query: String): Flow<List<ClientEntity>> =
        if (query.isBlank()) clientDao.observeAll() else clientDao.search(query.trim())

    fun observeById(id: Long): Flow<ClientEntity?> = clientDao.observeById(id)

    suspend fun getById(id: Long): ClientEntity? = clientDao.getById(id)

    /** Crée ou met à jour un client et retourne son identifiant. */
    suspend fun save(client: ClientEntity): Long {
        val cleaned = client.copy(
            name = client.name.trim(),
            phone = client.phone.trim(),
            address = client.address.trim(),
            notes = client.notes.trim()
        )
        return if (cleaned.id == 0L) {
            clientDao.insert(cleaned)
        } else {
            clientDao.update(cleaned)
            cleaned.id
        }
    }

    /**
     * Supprime un client. Retourne false si le client possède encore des devis
     * (contrainte de clé étrangère) : on ne supprime jamais de devis en cascade.
     */
    suspend fun delete(client: ClientEntity): Boolean = try {
        clientDao.delete(client)
        true
    } catch (error: android.database.sqlite.SQLiteConstraintException) {
        false
    }
}
