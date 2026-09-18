package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.RoomItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RoomItemDao {

    @Query("SELECT * FROM quote_rooms WHERE quoteId = :quoteId ORDER BY position ASC, id ASC")
    fun observeByQuote(quoteId: Long): Flow<List<RoomItemEntity>>

    @Query("SELECT * FROM quote_rooms WHERE quoteId = :quoteId ORDER BY position ASC, id ASC")
    suspend fun getByQuote(quoteId: Long): List<RoomItemEntity>

    @Query("SELECT * FROM quote_rooms WHERE id = :id")
    fun observeById(id: Long): Flow<RoomItemEntity?>

    @Query("SELECT * FROM quote_rooms WHERE id = :id")
    suspend fun getById(id: Long): RoomItemEntity?

    @Query("SELECT IFNULL(MAX(position), -1) + 1 FROM quote_rooms WHERE quoteId = :quoteId")
    suspend fun nextPosition(quoteId: Long): Int

    @Insert
    suspend fun insert(room: RoomItemEntity): Long

    @Update
    suspend fun update(room: RoomItemEntity)

    @Delete
    suspend fun delete(room: RoomItemEntity)

    @Query("DELETE FROM quote_rooms WHERE id = :id")
    suspend fun deleteById(id: Long)
}
