package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.QuoteLineEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface QuoteLineDao {

    @Query("SELECT * FROM quote_lines WHERE quoteId = :quoteId ORDER BY position ASC, id ASC")
    fun observeByQuote(quoteId: Long): Flow<List<QuoteLineEntity>>

    @Query("SELECT * FROM quote_lines WHERE quoteId = :quoteId ORDER BY position ASC, id ASC")
    suspend fun getByQuote(quoteId: Long): List<QuoteLineEntity>

    @Query("SELECT * FROM quote_lines WHERE roomId = :roomId ORDER BY position ASC, id ASC")
    fun observeByRoom(roomId: Long): Flow<List<QuoteLineEntity>>

    @Query("SELECT * FROM quote_lines WHERE id = :id")
    suspend fun getById(id: Long): QuoteLineEntity?

    @Query("SELECT IFNULL(MAX(position), -1) + 1 FROM quote_lines WHERE quoteId = :quoteId")
    suspend fun nextPosition(quoteId: Long): Int

    @Insert
    suspend fun insert(line: QuoteLineEntity): Long

    @Insert
    suspend fun insertAll(lines: List<QuoteLineEntity>)

    @Update
    suspend fun update(line: QuoteLineEntity)

    @Delete
    suspend fun delete(line: QuoteLineEntity)

    @Query("DELETE FROM quote_lines WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM quote_lines WHERE roomId = :roomId")
    suspend fun deleteByRoom(roomId: Long)
}
