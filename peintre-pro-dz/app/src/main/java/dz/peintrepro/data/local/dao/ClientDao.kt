package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.ClientEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ClientDao {

    @Query("SELECT * FROM clients ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<ClientEntity>>

    @Query(
        """
        SELECT * FROM clients
        WHERE name LIKE '%' || :query || '%'
           OR phone LIKE '%' || :query || '%'
           OR address LIKE '%' || :query || '%'
        ORDER BY name COLLATE NOCASE ASC
        """
    )
    fun search(query: String): Flow<List<ClientEntity>>

    @Query("SELECT * FROM clients WHERE id = :id")
    fun observeById(id: Long): Flow<ClientEntity?>

    @Query("SELECT * FROM clients WHERE id = :id")
    suspend fun getById(id: Long): ClientEntity?

    @Query("SELECT COUNT(*) FROM clients")
    fun observeCount(): Flow<Int>

    @Insert
    suspend fun insert(client: ClientEntity): Long

    @Update
    suspend fun update(client: ClientEntity)

    @Delete
    suspend fun delete(client: ClientEntity)
}
